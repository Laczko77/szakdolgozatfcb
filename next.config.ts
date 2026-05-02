import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // isomorphic-dompurify uses jsdom on the server side, which includes
  // native-ish Node modules that cannot be inlined by the Vercel bundler.
  // Marking them as external lets the Lambda load them at runtime from
  // node_modules instead of bundling them into the function payload.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "iflftoukxmesdbcohcub.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // football-data.org csapat-címer CDN — F17 átállás óta minden meccs
      // hazai/vendég logó innen érkezik (Match.home_team_crest /
      // away_team_crest oszlopokban tárolt URL-ek).
      {
        protocol: "https",
        hostname: "crests.football-data.org",
        port: "",
        pathname: "/**",
      },
      // Néhány csapatnál a football-data.org közvetlenül a média endpoint-ot
      // adja vissza — engedjük azt is.
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
