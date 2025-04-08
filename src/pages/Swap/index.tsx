import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import SwapInput from '../../components/SwapInput';
import { useEffect, useState } from 'react';
import BackButton from '../../components/BackButton';
import TokenGraph from '../../components/TokenGraph';

export default function Swap() {
  const [tokenGraph, setTokenGraph] = useState('');
  const navigate = useNavigate();

  useEffect(() => navigate("/"), [navigate]);

  return (
    <div className="page-container">
      {
        !tokenGraph
          ? (
            <>
              <h1>Swap</h1>

              <SwapInput setTokenGraph={setTokenGraph} />
            </>
          ) : (
            <>
              <BackButton action={() => setTokenGraph('')} />

              <TokenGraph token={tokenGraph} />
            </>
          )
      }

      <Footer />
    </div>
  )
}