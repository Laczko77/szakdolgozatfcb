import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
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
