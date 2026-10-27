/**
 * GenieACS API client.
 *
 * Auth: Authorization: Basic base64(api_key:)
 * Base URL: configured via config.genieacs.baseUrl (default port 7557)
 *
 * GenieACS REST API:
 *   GET  /devices              - list all devices
 *   GET  /devices/{deviceId}   - get device details
 *   POST /devices/{deviceId}/refresh  - trigger inform
 *   POST /devices/{deviceId}/reboot   - reboot device
 *   PUT  /devices/{deviceId}/tasks    - set parameter values (Tasks)
 */

import { config } from "../config.js"

const REQUEST_TIMEOUT_MS = 10_000

export class GenieACSError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = "GenieACSError"
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenieACSDevice {
  /** Internal GenieACS _id */
  _id: string
  /** DeviceId = serial number */
  DeviceId: string
  DisplayName: string
  Tags: string[]
  Status: "Online" | "Offline"
  LastInform: string
  /** Virtual parameter for WiFi password */
  WlanPassword?: string
  /** SSID (resolved from TR-069 path) */
  SSID?: string
  /** Customer ID extracted from Tags */
  customerId?: string | number
}

export interface GenieACSConfig {
  baseUrl: string
  apiKey: string
  syncIntervalMinutes: number
  autoSyncOnAccess: boolean
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GenieACSService {
  private readonly base: string
  private readonly auth: string

  constructor(cfg?: Partial<GenieACSConfig>) {
    const baseUrl = cfg?.baseUrl ?? config.genieacs.baseUrl
    const apiKey = cfg?.apiKey ?? config.genieacs.apiKey
    this.base = baseUrl.replace(/\/$/, "")
    // Auth: Basic base64(api_key:)
    this.auth = Buffer.from(`${apiKey}:`).toString("base64")
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    try {
      const url = `${this.base}${path}`
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new GenieACSError(
          `GenieACS ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`,
          res.status,
        )
      }

      const txt = await res.text()
      return txt ? (JSON.parse(txt) as T) : ({} as T)
    } catch (err) {
      if (err instanceof GenieACSError) throw err
      if (err instanceof Error && err.name === "AbortError") {
        throw new GenieACSError(`Timeout (${REQUEST_TIMEOUT_MS}ms) contacting GenieACS at ${this.base}`)
      }
      throw new GenieACSError(`GenieACS request failed: ${(err as Error).message}`)
    }
  }

  // -------------------------------------------------------------------------
  // Device listing
  // -------------------------------------------------------------------------

  /**
   * Fetch all devices from GenieACS.
   * Returns raw device objects — caller maps to GenieACSDevice.
   */
  async getDevices(): Promise<Record<string, unknown>[]> {
    const data = await this.request<Record<string, unknown>[]>("/devices", "GET")
    return data
  }

  /**
   * Get a single device by its GenieACS _id.
   */
  async getDevice(deviceId: string): Promise<Record<string, unknown>> {
    return this.request(`/devices/${encodeURIComponent(deviceId)}`, "GET")
  }

  // -------------------------------------------------------------------------
  // Device actions
  // -------------------------------------------------------------------------

  /**
   * Refresh device — forces it to send an Inform to the ACS.
   */
  async refreshDevice(deviceId: string): Promise<void> {
    await this.request(`/devices/${encodeURIComponent(deviceId)}/refresh`, "POST")
  }

  /**
   * Reboot device via standard TR-069 Reboot RPC.
   */
  async rebootDevice(deviceId: string): Promise<void> {
    await this.request(`/devices/${encodeURIComponent(deviceId)}/reboot`, "POST")
  }

  /**
   * Set a single parameter value on the device via GenieACS Tasks.
   * path = full TR-069 parameter path, e.g. "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID"
   * value = string value to set
   */
  async setParameter(deviceId: string, path: string, value: string): Promise<void> {
    const task = {
      name: "SetParameterValues",
      parameterValues: [[path, value, "xsd:string"]],
    }
    await this.request(`/devices/${encodeURIComponent(deviceId)}/tasks`, "POST", task)
  }

  /**
   * Set WiFi credentials: SSID + WiFi password (WlanPassword virtual param).
   *
   * @param deviceId    GenieACS _id
   * @param ssid        New SSID name
   * @param wifiPassword New WiFi password
   * @param wlanIndex   WLANConfiguration index (default 1)
   */
  async setWifiParams(
    deviceId: string,
    ssid: string,
    wifiPassword: string,
    wlanIndex = 1,
  ): Promise<void> {
    const tasks = [
      // SSID
      {
        name: "SetParameterValues",
        parameterValues: [
          [
            `InternetGatewayDevice.LANDevice.${wlanIndex}.WLANConfiguration.${wlanIndex}.SSID`,
            ssid,
            "xsd:string",
          ],
        ],
      },
      // WiFi password via custom virtual parameter WlanPassword
      {
        name: "SetParameterValues",
        parameterValues: [[`WlanPassword`, wifiPassword, "xsd:string"]],
      },
    ]

    for (const task of tasks) {
      await this.request(`/devices/${encodeURIComponent(deviceId)}/tasks`, "POST", task)
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Determine online/offline status based on LastInform timestamp.
   * Devices that haven't informed in > 10 minutes are considered Offline.
   */
  static getDeviceStatus(lastInform: string): "Online" | "Offline" {
    const last = new Date(lastInform).getTime()
    const now = Date.now()
    const TEN_MINUTES_MS = 10 * 60 * 1000
    return now - last < TEN_MINUTES_MS ? "Online" : "Offline"
  }

  /**
   * Parse customer_id from device Tags array.
   * Tags format: ["customer_id:123", ...]
   */
  static extractCustomerId(tags: string[]): string | undefined {
    const tag = tags.find((t) => t.startsWith("customer_id:"))
    return tag ? tag.split(":")[1] : undefined
  }

  /**
   * Map a raw GenieACS device object to our simplified GenieACSDevice type.
   */
  static mapDevice(raw: Record<string, unknown>): GenieACSDevice {
    const tags = (raw.Tags as string[]) ?? []
    const lastInform = String(raw.LastInform ?? "")
    const status = GenieACSService.getDeviceStatus(lastInform)
    const customerIdStr = GenieACSService.extractCustomerId(tags)

    return {
      _id: String(raw._id ?? ""),
      DeviceId: String(raw.DeviceId ?? ""),
      DisplayName: String(raw.DisplayName ?? ""),
      Tags: tags,
      Status: status,
      LastInform: lastInform,
      WlanPassword: raw.WlanPassword as string | undefined,
      SSID: raw.SSID as string | undefined,
      customerId: customerIdStr ? Number(customerIdStr) : undefined,
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance (uses config values)
// ---------------------------------------------------------------------------

let _instance: GenieACSService | null = null

export function getGenieACSService(): GenieACSService {
  if (!_instance) {
    _instance = new GenieACSService()
  }
  return _instance
}

export function resetGenieACSService(): void {
  _instance = null
}
