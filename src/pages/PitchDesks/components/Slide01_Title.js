// src/components/Slide01_Title.js
import React from 'react';
import { Slide, Heading, Text } from 'spectacle';
import { FullScreen } from './layouts';

const TitleSlide = () => (
  <Slide>
    <FullScreen>
      <Heading fontSize="h1">CoNET</Heading>
      <Heading fontSize="h3" color="secondary" margin="64px 0">
        The Privacy Clearing Layer Replacing IP Addresses with Wallet IDs.
      </Heading>
      <Text textColor="tertiary" bold>
        Decentralized. Private. Metered.
      </Text>
    </FullScreen>
  </Slide>
);

export default TitleSlide;