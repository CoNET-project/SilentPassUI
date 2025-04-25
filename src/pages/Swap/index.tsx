import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import SwapInput from '../../components/SwapInput';
import { useState } from 'react';
import BackButton from '../../components/BackButton';
import TokenGraph from '../../components/TokenGraph';

export default function Swap() {
  const [tokenGraph, setTokenGraph] = useState('');
  const navigate = useNavigate();

  return (
    <div className="page-container">
      {
        !tokenGraph
          ? (
            <>
              <h1>Swap</h1>
				<p>Beta</p>
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