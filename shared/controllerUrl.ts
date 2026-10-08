/** Same host, protocol and actual port as the game; replace loopback only for LAN play. */
export function controllerUrlForRoom(origin: string, roomCode: string, ips: readonly string[] = []): string {
  const url = new URL('/controller.html', origin);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    const ip = ips.find(value => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
      && value.split('.').every(part => Number(part) <= 255)
      && !value.startsWith('127.') && !value.startsWith('169.254.') && value !== '0.0.0.0');
    if (ip) url.hostname = ip;
  }
  url.searchParams.set('room', roomCode);
  return url.href;
}
