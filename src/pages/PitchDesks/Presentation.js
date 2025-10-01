// src/Presentation.js
import React from 'react';
import { Deck } from 'spectacle';
import { theme } from './theme';

// 导入所有幻灯片组件
import TitleSlide from './components/Slide01_Title';
import ThesisSlide from './components/Slide02_Thesis';
import ProblemSlide from './components/Slide03_Problem';
import SolutionSlide from './components/Slide04_Solution';
import HowItWorksSlide from './components/Slide05_HowItWorks';
import MoatSlide from './components/Slide06_Moat';
import TractionSlide from './components/Slide07_Traction';
import BusinessModelSlide from './components/Slide08_BusinessModel';
import TheAskSlide from './components/Slide09_TheAsk';
import ContactSlide from './components/Slide10_Contact';

const Presentation = () => (
  <Deck theme={theme}>
    <TitleSlide />
    <ThesisSlide />
    <ProblemSlide />
    <SolutionSlide />
    <HowItWorksSlide />
    <MoatSlide />
    <TractionSlide />
    <BusinessModelSlide />
    <TheAskSlide />
    <ContactSlide />
  </Deck>
);

export default Presentation;