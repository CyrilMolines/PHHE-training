import { SPHttpClient } from "@microsoft/sp-http";

export interface ITrainingFinderProps {
  description: string;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  userDisplayName: string;
  spHttpClient: SPHttpClient;
  siteAbsoluteUrl: string;
  listTitle: string;
}
