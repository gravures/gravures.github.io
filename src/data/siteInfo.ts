export type SocialLink = {
    me?: string;
    text: string;
    icon: string;
    href: string;
    platform: string;
    footerOnly?: boolean;
};

export type SiteInfo = {
    name: string;
    title: string;
    description: string;
    image?: {
        src: string;
        alt: string;
    };
    socialLinks?: SocialLink[];
};

// TODO: - socialLink
//       - i18n on siteInfo
const site: SiteInfo = {
    name: "ideographe",
    title: "ideographe",
    description: "Les meilleures idées naissent d’un problème",
    image: {
        src: "/img/pomme_pano_demi.jpg",
        alt: 'Les meilleures idées naissent d’un problème',
    },
}

export default site;

