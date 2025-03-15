import Menu from '../Menu';
import './index.css';

export default function Footer({ disableManagement }: any) {
  return (
    <div className="footer">
      <div className="footer-content">
        <Menu disableManagement={disableManagement} />
      </div>
    </div>
  )
}