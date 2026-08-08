import styled, { createGlobalStyle } from 'styled-components';
import BizNav from '../components/business/BizNav';
import BizHero from '../components/business/BizHero';
import BizFeatures from '../components/business/BizFeatures';
import BizHowItWorks from '../components/business/BizHowItWorks';
import BizUseCases from '../components/business/BizUseCases';
import BizCTA from '../components/business/BizCTA';
import BizFooter from '../components/business/BizFooter';

const GlobalDark = createGlobalStyle`
    body { background: #000000; }
`;

const BusinessHome = () => (
    <>
        <GlobalDark />
        <PageWrap>
            <BizNav />
            <BizHero />
            <BizFeatures />
            <BizHowItWorks />
            <BizUseCases />
            <BizCTA />
            <BizFooter />
        </PageWrap>
    </>
);

const PageWrap = styled.div`
    min-height: 100vh;
    background: #000000;
    color: #ffffff;
`;

export default BusinessHome;
