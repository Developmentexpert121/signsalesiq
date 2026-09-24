import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock the storage module before importing the middleware
vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
  },
}));
vi.mock("../logger", () => ({ logger: { error: vi.fn() } }));

import { requireTenantOwned } from "./requireTenantOwned";
import { storage } from "../storage";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: "resource-1" },
    session: { userId: "user-1" },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & { _status: number; _json: any } {
  const res: any = { _status: 0, _json: undefined };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (body: any) => {
    res._json = body;
    return res;
  };
  return res;
}

const next: NextFunction = vi.fn() as any;

describe("requireTenantOwned middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const req = makeReq({ session: {} as any });
    const res = makeRes();
    const loader = vi.fn();

    await requireTenantOwned(loader)(req, res, next);

    expect(res._status).toBe(401);
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns 404 when resource belongs to a different tenant", async () => {
    vi.mocked(storage.getUser).mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-A",
      role: "SALES",
    } as any);
    const loader = vi.fn().mockResolvedValue({ id: "resource-1", tenantId: "tenant-B" });
    const req = makeReq();
    const res = makeRes();

    await requireTenantOwned(loader)(req, res, next);

    expect(res._status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when resource belongs to the same tenant", async () => {
    vi.mocked(storage.getUser).mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-A",
      role: "SALES",
    } as any);
    const loader = vi.fn().mockResolvedValue({ id: "resource-1", tenantId: "tenant-A" });
    const req = makeReq();
    const res = makeRes();

    await requireTenantOwned(loader)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to access any tenant's resource", async () => {
    vi.mocked(storage.getUser).mockResolvedValue({
      id: "admin-1",
      tenantId: "tenant-admin",
      role: "SUPER_ADMIN",
    } as any);
    const loader = vi.fn().mockResolvedValue({ id: "resource-1", tenantId: "tenant-B" });
    const req = makeReq();
    const res = makeRes();

    await requireTenantOwned(loader)(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
