import { ethers } from 'ethers';
import { blobToDataUrl, IPFS_GET_FRAGMENT } from '@/utils/ipfsCardImageUpload';

const IPFS_API_BASE = 'https://ipfs.conet.network/api/';

/** Must match server FRAGMENT_UPLOAD_CHUNK_BYTES (512 KiB). */
export const IPFS_FRAGMENT_CHUNK_BYTES = 512 * 1024;

export type IpfsFragmentUploadProgress = {
  phase: 'prepare' | 'convert' | 'upload';
  /** 0–100 within current phase (upload) or overall slice when mapped by caller */
  percent: number;
  receivedBytes: number;
  totalBytes: number;
  /** User-visible workflow line, e.g. "Uploading part 12 of 847" */
  message: string;
  chunkIndex?: number;
  chunkTotal?: number;
};

type ProfileWithKey = {
  privateKeyArmor: string;
};

async function signFragmentWallet(profile: ProfileWithKey): Promise<{
  wallet: ethers.Wallet;
  signMessage: string;
}> {
  const wallet = new ethers.Wallet(profile.privateKeyArmor);
  const signMessage = await wallet.signMessage(wallet.address);
  return { wallet, signMessage };
}

async function fetchChunkStatus(args: {
  hash: string;
  wallet: string;
  signMessage: string;
  signal?: AbortSignal;
}): Promise<{ complete: boolean; received: number; totalSize: number | null }> {
  const params = new URLSearchParams({
    hash: args.hash,
    wallet: args.wallet,
    signMessage: args.signMessage,
  });
  const resp = await fetch(`${IPFS_API_BASE}storageFragmentChunkStatus?${params.toString()}`, {
    method: 'GET',
    signal: args.signal,
  });
  const data = (await resp.json().catch(() => null)) as {
    ok?: boolean;
    complete?: boolean;
    received?: number;
    totalSize?: number | null;
    error?: string;
  } | null;
  if (!resp.ok || !data?.ok) {
    throw new Error(data?.error || `Upload status failed (${resp.status})`);
  }
  return {
    complete: data.complete === true,
    received: Number.isFinite(data.received) ? Number(data.received) : 0,
    totalSize:
      data.totalSize != null && Number.isFinite(data.totalSize) ? Number(data.totalSize) : null,
  };
}

async function postChunk(args: {
  hash: string;
  wallet: string;
  signMessage: string;
  totalSize: number;
  offset: number;
  chunkBytes: Uint8Array;
  signal?: AbortSignal;
}): Promise<{ received: number; complete: boolean }> {
  const form = new FormData();
  form.append('wallet', args.wallet);
  form.append('signMessage', args.signMessage);
  form.append('hash', args.hash);
  form.append('totalSize', String(args.totalSize));
  form.append('offset', String(args.offset));
  form.append('chunk', new Blob([args.chunkBytes]), 'chunk');

  const resp = await fetch(`${IPFS_API_BASE}storageFragmentChunk`, {
    method: 'POST',
    signal: args.signal,
    body: form,
  });
  const data = (await resp.json().catch(() => null)) as {
    ok?: boolean;
    received?: number;
    complete?: boolean;
    error?: string;
  } | null;
  if (!resp.ok || !data?.ok) {
    throw new Error(data?.error || `Chunk upload failed (${resp.status})`);
  }
  return {
    received: Number.isFinite(data.received) ? Number(data.received) : args.offset + args.chunkBytes.length,
    complete: data.complete === true,
  };
}

function wrapNetworkError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|aborted/i.test(msg)) {
    return new Error(
      'Background upload failed: network error reaching ipfs.conet.network. Check your connection and try again.'
    );
  }
  return err instanceof Error ? err : new Error(msg || 'Upload failed');
}

/**
 * Upload a data URL to IPFS fragment storage in 512 KiB multipart chunks with resume.
 * Hash must be keccak256(utf8 dataUrl) — same as legacy storageFragment.
 */
export async function uploadDataUrlToIpfsChunked(
  profile: ProfileWithKey,
  dataUrl: string,
  onProgress?: (progress: IpfsFragmentUploadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(dataUrl));
  const payloadBytes = new TextEncoder().encode(dataUrl);
  const totalBytes = payloadBytes.length;

  onProgress?.({
    phase: 'upload',
    percent: 0,
    receivedBytes: 0,
    totalBytes,
    message: 'Preparing upload…',
  });

  const { wallet, signMessage } = await signFragmentWallet(profile);

  let offset = 0;
  try {
    const status = await fetchChunkStatus({
      hash,
      wallet: wallet.address,
      signMessage,
      signal,
    });
    if (status.complete) {
      onProgress?.({
        phase: 'upload',
        percent: 100,
        receivedBytes: totalBytes,
        totalBytes,
        message: 'Upload complete',
      });
      return hash;
    }
    if (status.totalSize != null && status.totalSize !== totalBytes) {
      throw new Error('Resume conflict: upload size changed. Cancel and try again.');
    }
    offset = Math.min(status.received, totalBytes);
  } catch (err) {
    throw wrapNetworkError(err);
  }

  const chunkTotal = Math.max(1, Math.ceil(totalBytes / IPFS_FRAGMENT_CHUNK_BYTES));

  const report = (
    receivedBytes: number,
    message: string,
    chunkIndex?: number
  ) => {
    const uploadPct = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 100;
    onProgress?.({
      phase: 'upload',
      percent: Math.min(100, Math.round(uploadPct)),
      receivedBytes,
      totalBytes,
      message,
      chunkIndex,
      chunkTotal,
    });
  };

  report(
    offset,
    offset > 0 ? `Resuming upload (part ${Math.min(chunkTotal, Math.floor(offset / IPFS_FRAGMENT_CHUNK_BYTES) + 1)} of ${chunkTotal})…` : `Uploading part 1 of ${chunkTotal}…`,
    offset > 0 ? Math.min(chunkTotal, Math.floor(offset / IPFS_FRAGMENT_CHUNK_BYTES) + 1) : 1
  );

  while (offset < totalBytes) {
    const chunkIndex = Math.floor(offset / IPFS_FRAGMENT_CHUNK_BYTES) + 1;
    report(offset, `Uploading part ${chunkIndex} of ${chunkTotal}…`, chunkIndex);
    try {
      const result = await postChunk({
        hash,
        wallet: wallet.address,
        signMessage,
        totalSize: totalBytes,
        offset,
        chunkBytes: payloadBytes.subarray(offset, Math.min(totalBytes, offset + IPFS_FRAGMENT_CHUNK_BYTES)),
        signal,
      });
      offset = result.received;
      if (result.complete) {
        report(totalBytes, 'Upload complete', chunkTotal);
        break;
      }
    } catch (err) {
      throw wrapNetworkError(err);
    }
  }

  return hash;
}

/** Upload a media file using chunked fragment API (builds data URL, same hash as legacy postToIPFS). */
export async function uploadMediaFileToIpfsChunked(
  profile: ProfileWithKey,
  file: File,
  onProgress?: (progress: IpfsFragmentUploadProgress) => void,
  signal?: AbortSignal
): Promise<string> {
  onProgress?.({
    phase: 'prepare',
    percent: 0,
    receivedBytes: 0,
    totalBytes: file.size,
    message: 'Preparing file for upload…',
  });
  const dataUrl = await blobToDataUrl(file);
  if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
  onProgress?.({
    phase: 'prepare',
    percent: 100,
    receivedBytes: file.size,
    totalBytes: file.size,
    message: 'Preparing file for upload…',
  });
  return uploadDataUrlToIpfsChunked(profile, dataUrl, onProgress, signal);
}

export function ipfsFragmentUrlFromHash(hash: string): string {
  return `${IPFS_GET_FRAGMENT}${hash}&t=${Date.now()}`;
}
