// V-E2E's setup: the journeys' database exists and carries the committed schema before the first
// journey runs. The web server is started by the config's `webServer` and reads the same URL; it
// opens no connection until a journey asks it to, which is what lets the two agree by name.
import { provisionE2eDatabase } from "./scratch-db";

export default function globalSetup(): void {
  provisionE2eDatabase();
}
