/**
 * Registers every built-in tool by side effect. Import this file once at
 * server startup so `getTool()` lookups see all built-ins.
 */
import "./web";
import "./time";
import "./notes";
