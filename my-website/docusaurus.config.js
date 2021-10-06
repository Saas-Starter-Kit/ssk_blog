const lightCodeTheme = require("prism-react-renderer/themes/github")
const darkCodeTheme = require("prism-react-renderer/themes/dracula")

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: "React and Nodejs Boilerplate",
  tagline: "React and Nodejs Boilerplate",
  url: "https://saasstarterkit.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "facebook", // Usually your GitHub org/user name.
  projectName: "docusaurus", // Usually your repo name.

  presets: [
    [
      "@docusaurus/preset-classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl: "https://github.com/facebook/docusaurus/edit/main/website/blog/",
          path: "./blog",
          routeBasePath: "/", // Set this value to '/'.
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "Saas Starter Kit",
        logo: {
          alt: "My Site Logo",
          src: "img/logo.svg",
          href: "https://www.saasstarterkit.com",
        },
        items: [
          {
            href: "https://github.com/Saas-Starter-Kit",
            className: "header-github-link",
            position: "right",
          },
        ],
      },

      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
}
