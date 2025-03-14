import styled from 'styled-components';

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 16px;
`;

const PopupContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 56px;
  background: #191919;
  border-radius: 16px;
  width: 100%;
  max-width: 380px;
`;

const PopupContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 56px;
  padding: 0 16px 16px 16px;
  width: 100%;
`;

const CardTop = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const InfoContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 300px
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 8px;
  border: 0;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
  color: #9fbfe5fe;
  background-color: #9fbfe533;
`;

const SP_EARNED_FROM_REFERRAL = 10

const SpClubCongratsPopup = ({ setIsCongratsPopupOpen, memberId }: any) => {

  return (
    <Backdrop onClick={() => setIsCongratsPopupOpen(false)}>
      <PopupContainer onClick={(e) => e.stopPropagation()}>
        <CardTop>
          <img src="/assets/congrats-card-top.png" alt="congrats" style={{ width: '100%', height: '100%', borderRadius: '16px 16px 0 0' }} />
          <img src="/assets/clapping-hands.png" alt="congrats" style={{ width: '88px', height: '88px', marginTop: '-65px' }} />
        </CardTop>

        <PopupContent>
          <TextContent>
            <TitleContainer>
              <div style={{ fontSize: '32px' }}>Congratulations!</div>
              <div style={{ fontSize: '20px', width: '300px' }}>You've earned <span style={{ color: '#9FBFE5FE', fontWeight: '700' }}>{SP_EARNED_FROM_REFERRAL} $SP</span> and unlocked access to the <span style={{ color: '#9FBFE5FE', fontWeight: '700' }}>SP Club!</span></div>
            </TitleContainer>
            <InfoContainer>
              <div style={{ fontSize: '16px', color: '#989899' }}>Your SP Club Member ID:</div>
              <div style={{ fontSize: '16px' }}>{memberId}</div>
            </InfoContainer>
          </TextContent>

          <ButtonsContainer>
            <Button onClick={() => setIsCongratsPopupOpen(false)}>Close</Button>
          </ButtonsContainer>
        </PopupContent>
      </PopupContainer>
    </Backdrop>
  );
};

export default SpClubCongratsPopup;
