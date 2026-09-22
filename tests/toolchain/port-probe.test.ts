// "Is a port held?" is asked one way in this tree — by binding it (scripts/lib/port-probe.mjs). The
// gate read `ss -ltn`, which under WSL2 mirrored networking cannot see a port Windows holds: it read
// the journeys' port free while the served lanes died on EADDRINUSE 20–37 s in. What is worth proving
// is the probe's answer against a listener this file OWNS (so the verdict cannot depend on what else
// the box is running), and who `ss` says holds a port, read through an injected runner.
import { createServer, type AddressInfo, type Server } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { HELD_OUTSIDE_LINUX, attribution, heldPorts, portState } from "../../scripts/lib/port-probe.mjs";

const owned: Server[] = [];

/** A listener this file owns, on a port the kernel picks. */
async function listen(host = "127.0.0.1"): Promise<{ server: Server; port: number }> {
  const server = createServer();
  await new Promise<void>((listening, failed) => {
    server.once("error", failed);
    server.listen(0, host, () => listening());
  });
  owned.push(server);
  return { server, port: (server.address() as AddressInfo).port };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((closed) => server.close(() => closed()));
}

afterEach(async () => {
  await Promise.all(owned.splice(0).filter((server) => server.listening).map(close));
});

describe("portState binds the port and gives it straight back", () => {
  test("a port this file listens on reads busy — on its own host and on 0.0.0.0, where `pnpm dev --host` binds", async () => {
    const { port } = await listen();
    expect(await portState(port)).toBe("busy");
    expect(await portState(port, "0.0.0.0"), "a wildcard bind collides with a loopback listener, so dev --host is refused too").toBe("busy");
  });

  test("the same port reads free once the listener is closed — and asking did not keep it", async () => {
    const { server, port } = await listen();
    await close(server);
    expect(await portState(port)).toBe("free");
    expect(await portState(port), "the probe gave the port back: asking twice answers the same").toBe("free");
  });
});

describe("heldPorts", () => {
  test("answers the held ports only, in the order asked", async () => {
    const held = await listen();
    const released = await listen();
    await close(released.server);
    expect(await heldPorts([held.port, released.port])).toEqual([held.port]);
    expect(await heldPorts([released.port, held.port])).toEqual([held.port]);
  });

  test("asks each port once and one at a time, through the injected probe", async () => {
    const asked: number[] = [];
    let inFlight = 0;
    const answered = await heldPorts([7001, 7002, 7001, 7003], async (port) => {
      inFlight += 1;
      expect(inFlight, "two binds in flight from one process would read each other as busy").toBe(1);
      asked.push(port);
      await Promise.resolve();
      inFlight -= 1;
      return port === 7002 ? "busy" : "free";
    });
    expect(asked, "a port named twice (PORT equal to E2E_PORT, say) is asked once").toEqual([7001, 7002, 7003]);
    expect(answered).toEqual([7002]);
  });
});

describe("attribution says who holds a busy port, as `ss -ltnp` tells it", () => {
  const SS = [
    "State  Recv-Q Send-Q  Local Address:Port Peer Address:PortProcess",
    'LISTEN 0      511         127.0.0.1:41000      0.0.0.0:*    users:(("next-server (v1",pid=4242,fd=21))',
    "LISTEN 0      600         127.0.0.1:41001      0.0.0.0:*",
    'LISTEN 0      511                 *:41002            *:*    users:(("node",pid=77,fd=3))',
    "",
  ].join("\n");

  /** An injected runner that answers `ss -ltnp` with `stdout`, and records what it was asked. */
  function ss(stdout: string, status = 0) {
    const calls: { command: string; args: string[] }[] = [];
    const run = (command: string, args: string[]) => {
      calls.push({ command, args });
      return { status, stdout };
    };
    return { run, calls };
  }

  test("a Linux listener is named by process and pid; ss is asked for listeners with their processes", () => {
    const { run, calls } = ss(SS);
    expect(attribution(41000, run)).toBe('a Linux listener ("next-server (v1" pid=4242)');
    expect(attribution(41002, run)).toBe('a Linux listener ("node" pid=77)');
    expect(calls[0]).toEqual({ command: "ss", args: ["-ltnp"] });
  });

  test("a Linux listener whose process this user cannot read is still a Linux listener", () => {
    expect(attribution(41001, ss(SS).run)).toBe("a Linux listener (process not readable by this user)");
  });

  test("a busy port no Linux listener holds is held outside Linux — and the words say where to look", () => {
    expect(attribution(41003, ss(SS).run)).toBe(HELD_OUTSIDE_LINUX);
    expect(HELD_OUTSIDE_LINUX).toContain("not visible to ss");
    expect(HELD_OUTSIDE_LINUX).toContain("netstat.exe -ano");
    expect(HELD_OUTSIDE_LINUX).toContain("netsh interface portproxy show all");
    // A port is matched whole: 1000 is not 41000's tail.
    expect(attribution(1000, ss(SS).run)).toBe(HELD_OUTSIDE_LINUX);
  });

  test("a box whose ss cannot be read says so rather than blaming Windows", () => {
    expect(attribution(41000, ss("", 1).run)).toMatch(/^unattributed — ss could not be read/);
  });
});
