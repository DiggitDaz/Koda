import { createContext, useContext } from 'react';

export const TutorialContext = createContext({
    tourStep:    0,
    setTourStep: () => {},
    dismissTour: () => {},
});

export const useTutorial = () => useContext(TutorialContext);
