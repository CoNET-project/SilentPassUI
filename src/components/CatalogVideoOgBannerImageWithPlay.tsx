import { useEffect, useState } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import { CatalogVideoOgPlayOverlay } from '@/components/CatalogVideoOgPlayOverlay';
import { compositeCatalogVideoOgBannerWithPlayJpeg } from '@/utils/catalogVideoOgBannerPlayComposite';
import { CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME } from '@/utils/catalogProductionVideoOgConstants';

type Props = {
  imageUrl: string;
  className?: string;
  previewLayout?: boolean;
};

/**
 * Banner still → JPEG with centered play badge baked in; falls back to img + CSS overlay.
 */
export function CatalogVideoOgBannerImageWithPlay(props: Props) {
  const src = props.imageUrl.trim();
  const [jpegWithPlay, setJpegWithPlay] = useState<string | null>(null);
  const [useCssOverlay, setUseCssOverlay] = useState(false);

  useEffect(() => {
    let active = true;
    setJpegWithPlay(null);
    setUseCssOverlay(false);
    if (!src) return () => {
      active = false;
    };

    void compositeCatalogVideoOgBannerWithPlayJpeg(src).then((dataUrl) => {
      if (!active) return;
      if (dataUrl) {
        setJpegWithPlay(dataUrl);
        setUseCssOverlay(false);
      } else {
        setUseCssOverlay(true);
      }
    });

    return () => {
      active = false;
    };
  }, [src]);

  if (!src) return null;

  const displaySrc = jpegWithPlay ?? src;
  const showOverlay = useCssOverlay || !jpegWithPlay;

  return (
    <>
      <IpfsImg
        src={displaySrc}
        alt=""
        className={props.className ?? CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME}
        draggable={false}
      />
      {showOverlay ? <CatalogVideoOgPlayOverlay previewLayout={props.previewLayout} /> : null}
    </>
  );
}
