// src/components/Slide09_TheAsk.js
import React from 'react';
import { Slide, Heading, UnorderedList, ListItem, Text } from 'spectacle';
import { TwoColumn } from './layouts';
import styled from 'styled-components';

const ChartContainer = styled.div`
  width: 100%;
  font-size: 20px;
`;

const Bar = styled.div`
  background-color: ${props => props.color || '#00BFFF'};
  width: ${props => props.width};
  padding: 10px;
  margin: 8px 0;
  color: #1D2129;
  font-weight: bold;
  text-align: left;
`;

const UseOfProceedsChart = () => (
  <ChartContainer>
    <Text textAlign="left" bold>Use of Proceeds:</Text>
    <Bar width="40%" color="#00BFFF">40% - Network & Supply</Bar>
    <Bar width="35%" color="#49D4F2">35% - Demand Engine & Growth</Bar>
    <Bar width="15%" color="#87E9FF">15% - Core R&D</Bar>
    <Bar width="10%" color="#C2F3FF">10% - Compliance & GTM</Bar>
  </ChartContainer>
);

const TheAskSlide = () => (
  <Slide>
    <Heading>The Ask</Heading>
    <TwoColumn>
      <div>
        <Text textAlign="left" margin="40px 0">
          We are raising a SAFT round to accelerate our network deployment and capture the immediate market opportunity.
        </Text>
        <UnorderedList>
          <ListItem><Text><strong>Round:</strong> Seed / Private</Text></ListItem>
          <ListItem><Text><strong>Instrument:</strong> SAFT</Text></ListItem>
          <ListItem><Text><strong>Target Raise:</strong> $5.8M - $6.7M</Text></ListItem>
        </UnorderedList>
      </div>
      <UseOfProceedsChart />
    </TwoColumn>
  </Slide>
);

export default TheAskSlide;