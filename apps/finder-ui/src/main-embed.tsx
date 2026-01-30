import { render } from "preact";
import { AppEmbed } from "./ui/AppEmbed";
import "./ui/styles-embed.css";

render(<AppEmbed />, document.getElementById("app")!);
