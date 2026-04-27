import type { AgentRegistration, RegisterRequest, DiscoverQuery } from './types.js';

export class RegistryClient {
  private baseUrl: string;
  private agentId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(registryUrl = 'http://localhost:4200') {
    this.baseUrl = registryUrl;
  }

  async register(request: RegisterRequest): Promise<AgentRegistration> {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`Failed to register: ${res.statusText}`);
    }

    const registration = await res.json() as AgentRegistration;
    this.agentId = registration.id;

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat().catch(console.error);
    }, 10000);

    return registration;
  }

  async heartbeat(): Promise<void> {
    if (!this.agentId) return;

    const res = await fetch(`${this.baseUrl}/heartbeat/${this.agentId}`, {
      method: 'POST',
    });

    if (!res.ok && res.status === 404) {
      // Re-register if we got dropped
      console.warn('[meshkit] Lost registration, stopping heartbeat');
      this.stop();
    }
  }

  async unregister(): Promise<void> {
    if (!this.agentId) return;

    await fetch(`${this.baseUrl}/agents/${this.agentId}`, {
      method: 'DELETE',
    });

    this.stop();
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.agentId = null;
  }

  async discover(query: DiscoverQuery): Promise<AgentRegistration[]> {
    const params = new URLSearchParams();
    if (query.name) params.set('name', query.name);
    if (query.capability) params.set('capability', query.capability);

    const res = await fetch(`${this.baseUrl}/discover?${params}`);
    return res.json() as Promise<AgentRegistration[]>;
  }

  async list(): Promise<AgentRegistration[]> {
    const res = await fetch(`${this.baseUrl}/agents`);
    return res.json() as Promise<AgentRegistration[]>;
  }

  async get(id: string): Promise<AgentRegistration | null> {
    const res = await fetch(`${this.baseUrl}/agents/${id}`);
    if (!res.ok) return null;
    return res.json() as Promise<AgentRegistration>;
  }
}

export function createRegistryClient(url?: string): RegistryClient {
  return new RegistryClient(url);
}
