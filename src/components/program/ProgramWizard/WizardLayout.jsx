export default function WizardLayout({ children, currentStep, totalSteps }) {
  return (
    <div>
      <div>
        Step {currentStep} / {totalSteps}
      </div>
      {children}
    </div>
  );
}
