import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzePhoto, summarizeIssue, verifyResolution } from "./ai.server";

export const analyzeCivicPhoto = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        imageUrl: z.string().url(),
        description: z.string().optional(),
        locationName: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return analyzePhoto(data);
  });

export const verifyResolutionPhotos = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        beforeUrl: z.string().url(),
        afterUrl: z.string().url(),
        category: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return verifyResolution(data);
  });

export const generateIssueSummary = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        title: z.string(),
        category: z.string(),
        locationName: z.string(),
        reports: z.array(
          z.object({
            description: z.string().nullable(),
            severity: z.string(),
            created_at: z.string(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return { summary: await summarizeIssue(data) };
  });
