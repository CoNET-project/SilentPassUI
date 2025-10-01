// src/components/Slide03_Problem.js
import React from 'react';
import { Slide, Heading, Table, TableRow, TableHeader, TableCell, Text } from 'spectacle';
import styled from 'styled-components';

const StyledTable = styled(Table)`
  width: 100%;
  margin-top: 60px;
  border-collapse: collapse;
  th, td {
    border: 1px solid #444;
    padding: 16px;
    text-align: center;
  }
`;

const ProblemSlide = () => (
  <Slide>
    <Heading>Today's Solutions are a Compromise</Heading>
    <Text textColor="tertiary">You are forced to choose between connectivity, privacy, and accountability.</Text>
    <StyledTable>
      <thead>
        <TableRow>
          <TableHeader><Text bold>Solution</Text></TableHeader>
          <TableHeader><Text bold>Connects?</Text></TableHeader>
          <TableHeader><Text bold>Private?</Text></TableHeader>
          <TableHeader><Text bold>Metered & Auditable?</Text></TableHeader>
        </TableRow>
      </thead>
      <tbody>
        <TableRow>
          <TableCell><Text>VPN</Text></TableCell>
          <TableCell>✅</TableCell>
          <TableCell>⚠️</TableCell>
          <TableCell>❌</TableCell>
        </TableRow>
        <TableRow>
          <TableCell><Text>CDN</Text></TableCell>
          <TableCell>✅ (Ingress)</TableCell>
          <TableCell>❌</TableCell>
          <TableCell>❌</TableCell>
        </TableRow>
        <TableRow>
          <TableCell><Text>Proxy Networks</Text></TableCell>
          <TableCell>✅</TableCell>
          <TableCell>⚠️</TableCell>
          <TableCell>❌</TableCell>
        </TableRow>
      </tbody>
    </StyledTable>
  </Slide>
);

export default ProblemSlide;