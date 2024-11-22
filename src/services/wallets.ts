export const createOrGetWallet = async () => {
  if (!CoNET_Data?.profiles) {
    const acc = createKeyHDWallets();

    const key = await createGPGKey("", "", "");

    const profile: profile = {
      tokens: initProfileTokens(),
      publicKeyArmor: acc.publicKey,
      keyID: acc.address,
      isPrimary: true,
      referrer: null,
      isNode: false,
      pgpKey: {
        privateKeyArmor: key.privateKey,
        publicKeyArmor: key.publicKey,
      },
      privateKeyArmor: acc.signingKey.privateKey,
      hdPath: acc.path,
      index: acc.index,
      tickets: { balance: "0" },
    };

    CoNET_Data = {
      mnemonicPhrase: acc.mnemonic.phrase,
      profiles: [profile],
      isReady: true,
      ver: 0,
      nonce: 0,
    };
  }

  CoNET_Data.profiles.forEach(async (n) => {
    n.keyID = n.keyID.toLocaleLowerCase();
    await initV2(n);
    n.tokens.cCNTP.unlocked = false;
  });

  await getFaucet(
    CoNET_Data.profiles[0].keyID,
    CoNET_Data.profiles[0].privateKeyArmor
  );

  await getAllReferrer();

  await storeSystemData();

  const profile = CoNET_Data.profiles[0];

  const leaderboards = await getLeaderboards();

  const cmd: channelWroker = {
    cmd: "profileVer",
    data: [profile, leaderboards],
  };

  sendState("toFrontEnd", cmd);
};
