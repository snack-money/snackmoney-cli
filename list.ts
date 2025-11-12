import { useFacilitator } from "x402/verify";
import { facilitator } from "@coinbase/x402";
import { config } from "dotenv";

config();

async function main() {
  // Get the list function from the facilitator
  const { list } = useFacilitator(facilitator);
  // Fetch all available services
  const services = await list();

  const testnetServices = services.items.filter(item => item.accepts.find(paymentRequirements => paymentRequirements.asset == "0x036CbD53842c5426634e7929541eC2318f3dCF7e"));
  const snackMoneyServices = services.items.filter(item => item.resource.includes("snack.money"));

  console.log(JSON.stringify(testnetServices, null, 2));
}

main().catch(console.error);