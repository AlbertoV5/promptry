import { json } from "d3";
import { SITE_PREFIX } from "../../../config";

export type PlotDatum = [number, number];
export type Key = "kdpt_diffusion_anime" | "v4_anime_upscaler" | "v4_diffusion" | "v4_upscaler" | "v5_diffusion" | "v5_diffusion_anime";
export const keyLabels = [
    {key:  "kdpt_diffusion_anime", label: "V4 Niji"},
    {key:  "v4_anime_upscaler", label: "V4 NijiUp"},
    {key:  "v4_diffusion", label: "V4 Diffusion"},
    {key:  "v4_upscaler", label: "V4 Upscaler"},
    {key:  "v5_diffusion", label: "V5 Diffusion"},
    {key:  "v5_diffusion_anime", label: "V5 Niji"},
]
export const colors = {
    "kdpt_diffusion_anime": "#F9DF74",
    "v4_anime_upscaler": "#EDAE49",
    "v4_diffusion": "#6BE17A",
    "v4_upscaler": "#1EA559",
    "v5_diffusion": "#8cc9dc",
    "v5_diffusion_anime": "#75A5F0",
}
export const defaultChartData = {
    "kdpt_diffusion_anime": [],
    "v4_anime_upscaler": [],
    "v4_diffusion": [],
    "v4_upscaler": [],
    "v5_diffusion": [],
    "v5_diffusion_anime": [],
}
export const defaultKey = 'v5_diffusion_anime';

interface DataResult {
    data: Record<Key, number[]>;
    yesterday: string;
    today: string;
    kind: "historical" | "predicted";
}
export const storeSelected = (data: {key:string, sel: boolean}[]) => {
    localStorage.setItem(`${SITE_PREFIX}-selected`, JSON.stringify(data));
}
export const loadSelected = (): {key:string, sel: boolean}[] => {
    const data = localStorage.getItem(`${SITE_PREFIX}-selected`);
    return data ? JSON.parse(data) : undefined;
}
/** Returns data based on day offset. */
export async function getChartData(path: string = "/metrics/relax", offset: number = 1): Promise<DataResult>{
    // Get date from current time minus offset days. UTC not needed, apparently.
    const a = new Date().getTime() - (24 * (offset - 1)) * 1000 * 60 * 60;
    const b = new Date().getTime() - (24 * offset) * 1000 * 60 * 60;
    const today = new Date(a).toISOString().split('T')[0];
    const yesterday = new Date(b).toISOString().split('T')[0];
    // Construct file path.
    const dataURL = `${path}/${yesterday}_${today}.json`;
    try {
        const data = await json(dataURL) as Record<Key, number[]>;
        return {data: data, yesterday: yesterday, today: today, kind: offset === 0 ? "predicted" : "historical"}
    }
    catch {
        console.log(`Failed to fetch data from ${yesterday}`);
        return {data: defaultChartData, yesterday: yesterday, today: today, kind: offset === 0 ? "predicted" : "historical"}
    }
}