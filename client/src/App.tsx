import "@fontsource-variable/inter";
import "@fontsource-variable/inter";

import { PipecatClientProvider } from "@pipecat-ai/client-react";
import SamanthaCompanionUI from "./SamanthaCompanionUI";

export default function App() {
  // AudioClientHelper provides its own client, so we wrap the app with an empty provider
  return (
    <PipecatClientProvider>
      <SamanthaCompanionUI />
    </PipecatClientProvider>
  );
}