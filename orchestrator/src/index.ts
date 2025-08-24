import express from "express";
import fs from "fs";
import yaml from "yaml";
import path from "path";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Dynamic imports for ES modules
let kubeconfig: any, coreV1Api: any, appsV1Api: any, networkingV1Api: any;

const initializeK8s = async () => {
    const { KubeConfig, AppsV1Api, CoreV1Api, NetworkingV1Api } = await import("@kubernetes/client-node");
    kubeconfig = new KubeConfig();
    kubeconfig.loadFromDefault();
    coreV1Api = kubeconfig.makeApiClient(CoreV1Api);
    appsV1Api = kubeconfig.makeApiClient(AppsV1Api);
    networkingV1Api = kubeconfig.makeApiClient(NetworkingV1Api);
};

// Initialize K8s on startup
initializeK8s();

// Updated utility function to handle multi-document YAML files
const readAndParseKubeYaml = (filePath: string, execId: string): Array<any> => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const docs = yaml.parseAllDocuments(fileContent).map((doc) => {
        let docString = doc.toString();
        const regex = new RegExp(`service_name`, 'g');
        docString = docString.replace(regex, execId);
        console.log(docString);
        return yaml.parse(docString);
    });
    return docs;
};

// Resolve service.yaml from source root (works in dev and after build) instead of relying on relative dist path
const serviceYamlPath = path.resolve(process.cwd(), "service.yaml");

app.post("/start", async (req, res) => {
    const { userId, execId, replId } = req.body; // Accept both execId and replId
    const id = execId ?? replId;
    const namespace = "default"; // Assuming a default namespace, adjust as needed

    if (!id) {
        res.status(400).send({ message: "Missing execId/replId" });
        return;
    }

    try {
    const kubeManifests = readAndParseKubeYaml(serviceYamlPath, id);
        for (const manifest of kubeManifests) {
            switch (manifest.kind) {
                case "Deployment":
                    await appsV1Api.createNamespacedDeployment({ namespace, body: manifest });
                    break;
                case "Service":
                    await coreV1Api.createNamespacedService({ namespace, body: manifest });
                    break;
                case "Ingress":
                    await networkingV1Api.createNamespacedIngress({ namespace, body: manifest });
                    break;
                default:
                    console.log(`Unsupported kind: ${manifest.kind}`);
            }
        }
        res.status(200).send({ message: "Resources created successfully" });
    } catch (error) {
        console.error("Failed to create resources", error);
        res.status(500).send({ message: "Failed to create resources" });
    }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});