// The flow canvas needs to fill the full viewport without the root layout's
// max-width container and padding. This layout overrides just for this route.
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
