import { Header } from './components/Header';
import { DualWorkflowMvp } from './components/双功能MVP';

export default function App() {
  return <div className="mvp-shell" id="top">
    <Header reportingMode="course" />
    <DualWorkflowMvp />
  </div>;
}
