import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

export const esClient = process.env.ELASTICSEARCH_URL
  ? new Client({ node: process.env.ELASTICSEARCH_URL })
  : null;

export async function indexEmail(doc: Record<string, unknown>) {
  if (!esClient) return;
  try {
    await esClient.index({ index: "emails", id: doc.id as string, document: doc });
  } catch (err) {
    console.error("ES index error (non-fatal):", err);
  }
}

export async function searchEmails(q: string) {
  if (!esClient) return [];
  try {
    const res = await esClient.search({
      index: "emails",
      query: {
        multi_match: {
          query: q,
          fields: ["recipient", "subject", "body"],
        },
      },
    });
    return res.hits.hits.map((h) => h._source);
  } catch (err) {
    console.error("ES search error:", err);
    return [];
  }
}
