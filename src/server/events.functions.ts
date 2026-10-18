import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { requireUser } from "./auth.server";
import {
  appendEventForUser,
  parseEventCommand,
  readEventsForUser,
  resetDemoForUser,
} from "./events.server";

export const listEvents = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser(getRequestHeaders());
  return readEventsForUser(user.id);
});

export const appendEvent = createServerFn({ method: "POST" })
  .validator(parseEventCommand)
  .handler(async ({ data }) => {
    const user = await requireUser(getRequestHeaders());
    return appendEventForUser(user, data);
  });

export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser(getRequestHeaders());
  resetDemoForUser(user);
});
