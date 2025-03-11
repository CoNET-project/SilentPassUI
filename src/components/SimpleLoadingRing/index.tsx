import styled, { keyframes } from 'styled-components';

const rotationClock = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const LoadingRingContainer = styled.div`
  display: flex;
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
`;

const RotatingImage = styled.img`

`;

const RotationClock = styled(RotatingImage)`
  animation: ${rotationClock} 2s infinite linear;
`;

export default function SimpleLoadingRing() {
  return (
    <LoadingRingContainer>
      <RotationClock src="/assets/dentro.svg" />
    </LoadingRingContainer>
  );
}