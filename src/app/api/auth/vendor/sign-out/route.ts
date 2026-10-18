import { NextResponse } from "next/server";
import { POST as rootSignOutPOST, GET as rootSignOutGET } from "../../sign-out/route";

export async function POST(request: Request) {
  return rootSignOutPOST(request);
}

export async function GET(request: Request) {
  return rootSignOutGET(request);
}
