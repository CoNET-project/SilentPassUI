import { useNavigate } from 'react-router-dom';

import './index.css';

interface BackButtonProps {
  to?: string;
  action?: () => void;
}

export default function BackButton({ to, action }: BackButtonProps) {
  const navigate = useNavigate();

  function backButtonAction() {
    to && navigate(to);
    !to && !!action && action();
  }

  return (
    <button className="back-button" onClick={backButtonAction}>
      <img src="/assets/chevron-blue.svg" alt="Back" />
      <p>Back</p>
    </button>
  )
}