import { render } from "preact";
import { LinkValidator } from "./ui/LinkValidator";
import "./ui/styles-validator.css";

render(<LinkValidator />, document.getElementById("app")!);
