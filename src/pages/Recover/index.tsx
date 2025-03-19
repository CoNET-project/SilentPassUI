import { useState, useRef } from 'react';
import BackButton from '../../components/BackButton';

import './index.css';

import { ReactComponent as LightbulbIcon } from "./assets/lightbulb.svg";
import { createOrGetWallet } from '../../services/wallets';
import { useNavigate } from 'react-router-dom';
import SimpleLoadingRing from '../../components/SimpleLoadingRing';

export default function Recover() {
  const [phrases, setPhrases] = useState<string[]>(Array(12).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const [errorRecovering, setErrorRecovering] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const navigate = useNavigate();

  function handleWordChange(index: number, value: string) {
    if (value.includes(' ')) {
      const words = value.trim().split(/\s+/);
      const newPhrases = [...phrases];
      words.forEach((word, i) => {
        if (index + i < 12) {
          newPhrases[index + i] = word;
        }
      });
      setPhrases(newPhrases);

      if (index + words.length < 12) {
        inputsRef.current[index + words.length]?.focus();
      }
    } else {
      const newPhrases = [...phrases];
      newPhrases[index] = value;
      setPhrases(newPhrases);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    const pasteData = event.clipboardData.getData('text').trim();
    const words = pasteData.split(/\s+/);
    if (words.length === 12) {
      setPhrases(words);
    } else {
      const newPhrases = [...phrases];
      words.forEach((word, i) => {
        if (index + i < 12) {
          newPhrases[index + i] = word;
        }
      });
      setPhrases(newPhrases);
    }
  }

  async function handleRecoverWallet() {
    if (isButtonDisabled) return;

    try {
      setIsLoading(true);
      const joinedPhrases = phrases.join(" ");

      await createOrGetWallet(joinedPhrases);
      navigate("/")
    } catch (err) {
      console.log("ERROR: ", err);
      setErrorRecovering(true);
    } finally {
      setIsLoading(false);
    }
  }

  const isButtonDisabled = phrases.some(phrase => phrase.trim() === '');

  return (
    <div className="page-container recover-page">
      <div>
        <BackButton to="/" />
        <h1>Recover your account</h1>
      </div>
      <div className="descriptions">
        <p>Write or paste your phrase to recover your <b>account</b></p>
        <p>Make sure you’re using the correct Secret Recovery Phrase before proceeding. You will not be able to undo this and restore your account.</p>
      </div>

      <div className="word-grid">
        <div className="list">
          {phrases.map((phrase, i) => (
            <div key={i} className="word-list-item">
              <p>{i + 1}</p>
              <input
                ref={(el) => (inputsRef.current[i] = el)}
                value={phrase}
                onChange={(e) => handleWordChange(i, e.target.value)}
                onPaste={(e) => handlePaste(e, i)}
              />
            </div>
          ))}
        </div>
        <div className="warning">
          <LightbulbIcon />
          <p>Never lose your Secret Recovery Phrase</p>
        </div>
      </div>

      {errorRecovering && <span className="error-warn">An error occurred during recover. Check the phrase or try again later.</span>}

      <button className="recover-button" onClick={handleRecoverWallet} disabled={isButtonDisabled}>
        {isLoading ? <SimpleLoadingRing /> : "Recover account"}
      </button>
    </div>
  );
}