import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

export const getStaticPaths = (async () =>
  (await getCollection("docs")).map((entry) => ({
    params: { slug: entry.id.replace(/^docs\//, "") },
    props: { title: entry.data.title, body: entry.body ?? "" },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, url }) => {
  const page = url.href.replace(/\.md$/, "/");
  const markdown = `# ${props.title}

> Part of the rply docs. HTML version: ${page}. Index of all docs for LLMs: https://rply.sh/llms.txt

${props.body.trim()}
`;
  return new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
