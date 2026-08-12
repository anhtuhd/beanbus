export function isNavHrefActive(href: string, pathname: string, hash = ''): boolean {
  const [hrefPath, hrefHash] = href.split('#');
  if ((hrefPath || '/') !== pathname) return false;
  if (!hrefHash) return true;
  return hrefHash === (hash.replace(/^#/, '') || 'top');
}
