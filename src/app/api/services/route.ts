import { exec,spawn } from "child_process";
import net from "net";
import { NextRequest,NextResponse } from "next/server";
import { promisify } from "util";

const execAsync = promisify(exec);

// Puertos asociados a los servicios
const PORTS = {
  canva: 8001,
  comfyui: 8188,
};

const COMFYUI_PATH = process.env.COMFYUI_PATH || "D:\\ComfyUI Portable";

// Comprobar si un puerto está abierto y respondiendo (servicio encendido)
function isPortActive(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400); // 400ms es suficiente para un puerto local escuchando
    
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

// Detener el proceso que está escuchando en un puerto específico en Windows
async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    // Buscar PIDs en Windows que estén escuchando en ese puerto
    const { stdout } = await execAsync(`netstat -ano | findstr LISTENING | findstr :${port}`);
    if (!stdout.trim()) {
      return false; // No hay procesos escuchando en ese puerto
    }

    const lines = stdout.split("\n");
    const pids = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1]; // El PID es el último elemento
      if (pid && /^\d+$/.test(pid) && pid !== "0") {
        pids.add(pid);
      }
    }

    let killedAny = false;
    for (const pid of pids) {
      try {
        console.log(`Deteniendo proceso con PID ${pid} en el puerto ${port}...`);
        // /F fuerza la terminación, /T termina el proceso y los procesos hijos (árbol completo)
        await execAsync(`taskkill /F /T /PID ${pid}`);
        killedAny = true;
      } catch (killErr) {
        console.error(`Error killing PID ${pid}:`, killErr);
      }
    }

    return killedAny;
  } catch (err) {
    console.log(`No active process found listening on port ${port}.`);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "status") {
      const canvaActive = await isPortActive(PORTS.canva);
      const comfyuiActive = await isPortActive(PORTS.comfyui);
      const hasOpenaiEnvKey = !!process.env.OPENAI_API_KEY;
      const hasGeminiEnvKey = !!process.env.GEMINI_API_KEY;

      return NextResponse.json({
        success: true,
        services: {
          canva: { active: canvaActive, port: PORTS.canva },
          comfyui: { active: comfyuiActive, port: PORTS.comfyui },
          openai: { envKeySet: hasOpenaiEnvKey },
          gemini: { envKeySet: hasGeminiEnvKey },
        },
      });
    }

    return NextResponse.json({ error: "Missing or invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, service } = await request.json();

    if (!action || !service || (service !== "canva" && service !== "comfyui")) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    const port = PORTS[service as "canva" | "comfyui"];

    if (action === "start") {
      const active = await isPortActive(port);
      if (active) {
        return NextResponse.json({ success: true, message: `Service ${service} is already active` });
      }

      console.log(`Iniciando servicio ${service} en segundo plano...`);

      let command = "";
      if (service === "canva") {
        command = `cd /d "${process.cwd()}\\canva-integration\\server" && npm run dev`;
      } else if (service === "comfyui") {
        command = `cd /d "${COMFYUI_PATH}" && python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build --enable-cors-header --port ${port} --listen 127.0.0.1`;
      }

      // Clonar variables de entorno y sobreescribir PORT para evitar herencia de Next.js (3001)
      const childEnv = { ...process.env, PORT: String(port) };

      // Ejecutar en segundo plano desacoplado de forma robusta con entorno configurado
      const child = spawn(command, [], {
        detached: true,
        windowsHide: true,
        stdio: "ignore",
        shell: true,
        env: childEnv,
      });
      child.unref();

      // Esperar 2.5 segundos para dar tiempo a que el puerto se abra
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const nowActive = await isPortActive(port);

      return NextResponse.json({
        success: true,
        active: nowActive,
        message: `Started startup trigger for ${service}`,
      });
    }

    if (action === "stop") {
      const killed = await killProcessOnPort(port);
      
      // Esperar medio segundo para asegurar que se libere el puerto
      await new Promise((resolve) => setTimeout(resolve, 500));
      const nowActive = await isPortActive(port);

      return NextResponse.json({
        success: true,
        active: nowActive,
        killed,
        message: killed ? `Stopped service ${service}` : `No active processes to stop for ${service}`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}
