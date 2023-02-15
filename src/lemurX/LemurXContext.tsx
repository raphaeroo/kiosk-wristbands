import React, {ReactNode, createContext, useContext, useReducer} from 'react';

type LemurXContextDispatcher = React.Dispatch<Partial<LemurXContextInterface>>;

interface LemurXContextInterface {
  isDispenserConnected: boolean;
  isDispenserConfigured?: boolean;
}

const defaultContext: LemurXContextInterface = {
  isDispenserConnected: false,
  isDispenserConfigured: false,
};

interface PropsChildren {
  children: ReactNode;
}

const LemurXContext = createContext<LemurXContextInterface>(defaultContext);
const DispatchLemurXContext = createContext<
  LemurXContextDispatcher | undefined
>(undefined);

export const LemurXProvider = ({children}: PropsChildren) => {
  const [state, dispatch] = useReducer(
    (
      appState: LemurXContextInterface,
      newValue: Partial<LemurXContextInterface>,
    ) => ({
      ...appState,
      ...newValue,
    }),
    defaultContext,
  );

  return (
    <LemurXContext.Provider value={state}>
      <DispatchLemurXContext.Provider value={dispatch}>
        {children}
      </DispatchLemurXContext.Provider>
    </LemurXContext.Provider>
  );
};

export const useLemurXContext = (): [
  LemurXContextInterface,
  LemurXContextDispatcher | undefined,
] => [useContext(LemurXContext), useContext(DispatchLemurXContext)];
