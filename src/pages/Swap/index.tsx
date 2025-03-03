import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import SwapInput from '../../components/SwapInput';
import ReferralProgram from '../../components/AccountList/ReferralProgram';

export default function Swap() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1>Swap</h1>

      <SwapInput />

     
      <Footer />
    </div>
  )
}