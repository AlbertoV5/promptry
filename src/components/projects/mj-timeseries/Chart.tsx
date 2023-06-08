import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { select } from "d3-selection";
import { line, area } from "d3-shape";
import { scaleLinear, scaleTime } from "d3-scale";
import { axisBottom, axisLeft, curveBasis, timeFormat } from "d3";
import type { ScaleLinear, ScaleTime, ValueFn, Selection } from "d3";

// import { getChartData, Key, colors, keyLabels, loadSelected, storeSelected } from "./utils";
import * as utils from "./utils"
import { Selector } from "./components/Selector";
import { ChartBase, LayoutXAxis, LayoutYAxis} from "./components/ChartLayout";

import useWindowDimensions from "./utils/useWindowDimensions";


const getTime = () => {
    const utc = new Date().getTimezoneOffset() * 60000;
    const startOfToday = new Date().setHours(0, 0, 0, 0) - utc;
    const now = new Date().getTime();
    return (startOfToday - 24 * 60 * 60 * 1000) + (now % (24 * 60 * 60 * 1000));
}

const LocatorLine = ({svgRef, xAxis, y2}: {svgRef: React.RefObject<SVGLineElement>, xAxis: ScaleTime<number, number>, y2: number}) => {
    // Relative Time
    const drawLine = (time: number, color: string) => {
        select(svgRef.current)
            .attr("x1", xAxis(time))
            .attr("y1", 0)
            .attr("x2", xAxis(time))
            .attr("y2", y2)
            .style("stroke-width", STROKE_WIDTH)
            .style("stroke", color)
            .style("stroke-dasharray", 5)
            .style("opacity", 0.7)
            .style("fill", "none")
        ;
    }
    useEffect(() => {
        if (!svgRef.current) return;
        drawLine(getTime(), "#fff");
        // Update Line Every 15 minutes
        const intervalId = window.setInterval(() => drawLine(getTime(), "#fff"), 15 * 60000);
        return () => clearInterval(intervalId);
    }, [])
    return (
        <line ref={svgRef}></line>
    )
}

const getXAxis = (yesterday: number, today: number, dimensions: {width: number, height: number}) => {
    const xAxis = scaleTime()
        .domain([yesterday, today])
        .range([ 0, dimensions.width ])
    ;
    return xAxis;
}

const getYAxis = (max: number, dimensions: {width: number, height: number}) => {
    const yAxis = scaleLinear()
        .domain( [0, max] )
        .range([ dimensions.height, 0 ])
    ;
    return yAxis;
}

// Constants
const Y_LIMIT = 16;
const STROKE_WIDTH = 2;
const X_INTERVAL = 15 * 60 * 1000;
// Datetime
const utc = new Date().getTimezoneOffset() * 60000;
const startOfToday = new Date().setHours(0, 0, 0, 0) - utc;
const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
// mutable
const svgGroups: Record<string, Selection<SVGGElement, unknown, null, undefined> | undefined> = utils.keyLabels.reduce((prev, item) => ({...prev, [item.key]: undefined}), {} as Record<string, undefined>);

export default function Chart() {
    // Plot a linear + scatter chart.
    // https://observablehq.com/@d3/d3-line-chart
    const svgRef = useRef<SVGSVGElement>(null);
    const lineRef = useRef<SVGLineElement>(null);
    // State for data from request.
    const [chartData, setChartData] = useState<Record<string, number[]> | undefined>(undefined);
    const [selected, setSelected] = useState<{key:string, sel: boolean}[]>(() => utils.keyLabels.map(({key}) => ({key: key, sel: true})));
    const [dates, setDates] = useState<{yesterday: string | undefined, today: string | undefined,  kind: string | undefined}>({yesterday: undefined, today: undefined, kind: undefined});
    // Store groups for each category.
    const [svgGroups, setSvgGroups] = useState<Record<string, Selection<SVGGElement, unknown, null, undefined> | undefined>>(() => (
        utils.keyLabels.reduce((prev, item) => ({...prev, [item.key]: undefined}), {} as Record<string, undefined>)
    ));
    // Dimensions (client-side).
    const {width, height} = useWindowDimensions();
    const margin = {top: 30, right: height > width ? 20 : 40, bottom: 30, left: height > width ? 20 : 40};
    const dimensions = {width: (width * 0.98) - margin.left - margin.right, height: height * 0.6 - margin.top - margin.bottom}
    // Axis.
    const xAxis = getXAxis(startOfYesterday, startOfToday, dimensions);
    const yAxis = getYAxis(Y_LIMIT, dimensions);
    // on Load (client-side).
    useEffect(() => {
        utils.getChartData()
        .then(({data, yesterday, today, kind}) => {
            setChartData(data);
            setDates({yesterday, today, kind});
            setSelected(prev => utils.loadSelected() || utils.keyLabels.map(({key}, i) => ({key, sel: i > 3 ? true : false})));
        });
    }, []);
    // Layout Effect.
    useLayoutEffect(() => {
        if (!svgRef.current || !chartData) return;
        const groups = svgGroups;
        const svg = select(svgRef.current);
        selected.forEach(({key, sel}) => {
            // create [x, y] data
            const rightPad = chartData[key][0];
            const data = [...chartData[key], rightPad].map((value, i) => ([startOfYesterday + (i * X_INTERVAL), value]));
            // Create group, initially hidden and disabled.
            const svgGroup = svg.append("g")
                .style("opacity", "0")
                .style("pointer-events", "none")
            groups[key] = svgGroup;
            // Add the area svg.
            svgGroup.append("path")
                .data([data])
                .attr("class", "area")
                .attr("fill", utils.colors[key as utils.Key])
                .attr("fill-opacity", 0.2)
                .attr("stroke", utils.colors[key as utils.Key])
                .attr("stroke-width", STROKE_WIDTH)
                .style("pointer-events", "none")
                .attr("d",
                    area()
                        .curve(curveBasis)
                        .x(([x, y]) => xAxis(x))
                        .y0(dimensions.height)
                        .y1(([x, y]) => yAxis(Math.min(y, Y_LIMIT))) as ValueFn<SVGPathElement, number[][], any>
                )
            ;
           const tooltip = select("body")
                .append("div")
                .attr("class", "bg-dark")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("padding", "10px")
                .style("pointer-events", "none")
            ;
            // Scatter plot.
            svgGroup.append("g")
                .selectAll("dot")
                .data(data)
                .join("circle")
                .attr("cx", ([x, y]) => xAxis(x))
                .attr("cy", ([x, y]) => yAxis(Math.min(y, Y_LIMIT)))
                .attr("r", 5)
                // .attr("r", ([x, y]) => y > Y_LIMIT ? Math.min(10, 5 * y / Y_LIMIT) : 5)
                .attr("fill", utils.colors[key as utils.Key])
                .attr("stroke", "#111111")
                // .attr("stroke", ([x, y]) => y > Y_LIMIT ? "#ffffff" : "#111111")
                .style("stroke-width", 1)
                .on("mouseover", (event: PointerEvent, d: any) => {
                    const hourMinutes = new Date(d[0]).toLocaleTimeString().replace(":00 ", " ");
                    const minutes = Math.trunc(d[1]);
                    const seconds = Math.trunc((d[1] - minutes) * 60).toFixed().padStart(2, '0');
                    const tooltipContent = `
                        <b>${utils.keyLabels.find(({key: k}) => k === key)?.label}</b> @ ${hourMinutes}
                        <br><b>Wait Time:</b> ${minutes.toFixed().padStart(2, '0')}:${seconds}
                    `;
                    tooltip.html(tooltipContent)
                        .style("left", `${event.pageX - 48}px`)
                        .style("top", `${event.pageY - 96}px`)
                        .style("border", `1px solid ${utils.colors[key as utils.Key]}cc`)
                        .style("opacity", 1.0);
                })
                .on("mouseout", () => {
                    tooltip.style("opacity", 0);
                })
            if (lineRef.current) select(lineRef.current).raise();
        })
        // Update SVG Groups state.
        setSvgGroups(groups);
        return () => {
        }
    }, [chartData])

    useEffect(() => {
        if (!selected) return;
        selected.forEach(({key, sel}) => {
            // toggle visibility with a 400 ms fade effect
            svgGroups[key]?.transition("ease").duration(400)
                .style("opacity", sel ? "1" : "0")
                .style("pointer-events", sel ? "all" : "none")
            ;
            svgGroups[key]?.raise();
            if (lineRef.current) select(lineRef.current).raise();
        });
    }, [selected])

    return (
        <section className='container-fluid'>
            <section className="row vstack gap-2">
                <section className="col-12 vstack">
                    <div className="d-flex justify-content-center">
                        <ChartBase svgRef={svgRef} margin={margin} dimensions={dimensions}>
                            <LayoutYAxis y={yAxis} dimensions={dimensions} />
                            <LayoutXAxis x={xAxis} dimensions={dimensions} />
                            <LocatorLine svgRef={lineRef} xAxis={xAxis} y2={dimensions.height + 20} />
                        </ChartBase>
                    </div>
                    <div className="gap-2 d-flex justify-content-around">
                        <p className="form-text">{dates.yesterday} to {dates.today} UTC {dates.kind} data.</p>
                    </div>
                </section>
                <Selector
                    selected={selected}
                    setSelected={setSelected}
                    keyLabels={utils.keyLabels}
                    colors={utils.colors}
                    storeSelected={utils.storeSelected}
                />
            </section>
        </section>
    )
}