"use client"

import { useOnboardingState } from '@/hooks/useOnboardingState';
import { StepClassify } from '@/components/onboarding/StepClassify';
import { StepProfile } from '@/components/onboarding/StepProfile';
import { StepLoading } from '@/components/onboarding/StepLoading';
import { StepKnowledge } from '@/components/onboarding/StepKnowledge';
import { StepWhatsApp } from '@/components/onboarding/StepWhatsApp';
import { StepTest } from '@/components/onboarding/StepTest';
import { StepDeploy } from '@/components/onboarding/StepDeploy';

export default function OnboardingFlow() {
  const state = useOnboardingState();

  const widthClass = {
    1: "w-1/7", 2: "w-2/7", 3: "w-3/7", 4: "w-4/7", 5: "w-5/7", 6: "w-6/7", 7: "w-full"
  }[state.screen];

  const renderProgressBar = () => (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-20 bg-border-default">
      <div className={`h-full bg-brand transition-all duration-400 ease-out ${widthClass}`} style={{ width: `${(state.screen / 7) * 100}%` }} />
    </div>
  );

  const renderBackground = () => (
    <div className="fixed inset-0 z-0 bg-[url('/dashboard-preview.png')] bg-cover blur-[8px] brightness-[0.3] scale-105" />
  );

  return (
    <>
      {renderBackground()}
      {renderProgressBar()}

      <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
        
        {/* --- LOADING SCREEN (Step 3) --- */}
        {state.screen === 3 && (
          <StepLoading 
            classifyResult={state.classifyResult}
            ownerName={state.ownerName}
            phone={state.phone}
            setBotId={state.setBotId}
            setBotSlug={state.setBotSlug}
            onNext={() => state.setScreen(4)}
          />
        )}

        {/* --- STANDARD SCREENS CONTAINER --- */}
        {state.screen !== 3 && (
          <div key={state.screen} className="w-full max-w-[440px] bg-bg-secondary border border-border-default rounded-2xl p-8 relative z-10 animate-[slideUp_0.25s_ease_forwards] flex flex-col min-h-[420px]">
            
            {state.screen === 1 && (
              <StepClassify 
                businessDescription={state.businessDescription}
                setBusinessDescription={state.setBusinessDescription}
                setClassifyResult={state.setClassifyResult}
                onNext={() => state.setScreen(2)}
              />
            )}

            {state.screen === 2 && (
              <StepProfile 
                ownerName={state.ownerName}
                setOwnerName={state.setOwnerName}
                phone={state.phone}
                setPhone={state.setPhone}
                onNext={() => state.setScreen(3)}
                onBack={() => state.setScreen(1)}
              />
            )}

            {state.screen === 4 && (
              <StepKnowledge 
                botId={state.botId}
                uploadType={state.uploadType}
                setUploadType={state.setUploadType}
                urlInput={state.urlInput}
                setUrlInput={state.setUrlInput}
                fileInput={state.fileInput}
                setFileInput={state.setFileInput}
                onNext={() => state.setScreen(5)}
              />
            )}

            {state.screen === 5 && (
              <StepWhatsApp 
                botId={state.botId}
                waConnected={state.waConnected}
                setWaConnected={state.setWaConnected}
                onNext={() => state.setScreen(6)}
              />
            )}

            {state.screen === 6 && (
              <StepTest 
                botSlug={state.botSlug}
                ownerName={state.ownerName}
                testMessages={state.testMessages}
                setTestMessages={state.setTestMessages}
                hasTestedBot={state.hasTestedBot}
                setHasTestedBot={state.setHasTestedBot}
                onNext={() => state.setScreen(7)}
              />
            )}

            {state.screen === 7 && (
              <StepDeploy 
                botId={state.botId}
                botSlug={state.botSlug}
                playgroundUrl={state.playgroundUrl}
                setPlaygroundUrl={state.setPlaygroundUrl}
                embedCode={state.embedCode}
                setEmbedCode={state.setEmbedCode}
              />
            )}
            
          </div>
        )}
      </div>
    </>
  );
}
