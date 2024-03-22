import { getIdByAddressCaseInsensitive } from "../../postgresTables/readFunctions/Pools.js";
import { ADRESS_TRICRYPTO_2 } from "../utils/Constants.js";
import { calculateDailySandwichVolumes, calculateDailyVolumes, dailyVolumeByAtomicArb } from "../utils/Volume.js";
import ExcelJS from "exceljs";
export async function getGeneralVolumeTricrypto2() {
  const poolId = await getIdByAddressCaseInsensitive(ADRESS_TRICRYPTO_2);
  console.log("running Tricrypto2.");
  console.log("ADRESS_TRICRYPTO_2", ADRESS_TRICRYPTO_2);
  console.log("poolId", poolId);
  console.log("");
  // Full October
  const startUnixtime = 1696111200;
  const endUnixtime = 1698793199;
  console.log("total daily volume in tricrypto2");
  const dailyVolumes = await calculateDailyVolumes(poolId, startUnixtime, endUnixtime);
  Object.entries(dailyVolumes).forEach(([day, volume]) => {
    const formattedVol = Number(volume.toFixed(0)) / 1e6;
    console.log(`Date: ${day}, Total Volume in $Million: ${formattedVol}`);
  });
  console.log("\ndaily volume in tricrypto2 via front and backruns");
  const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId);
  Object.entries(sandwichDailyVolumes).forEach(([day, volume]) => {
    const formattedVol = Number(volume.toFixed(0)) / 1e3;
    console.log(`Date: ${day}, Sandwich Attack Volume in k$: ${formattedVol}`);
  });
  /*
    console.log("\ndaily userLoss in tricrypto2 via sandwiched");
    const sandwichDailyUserLosses = await calculateDailySandwichUserLoss(poolId!);
    Object.entries(sandwichDailyUserLosses).forEach(([day, volume]) => {
      const formattedVol = Number(volume.toFixed(0));
      console.log(`Date: ${day}, Sandwich User Loss in $: ${formattedVol}`);
    });
    */
  console.log("\ndaily volume in tricrypto2 via atomic arbs");
  const dailyArbVolumes = await dailyVolumeByAtomicArb(poolId);
  Object.entries(dailyArbVolumes).forEach(([day, volume]) => {
    const formattedVol = Number(volume.toFixed(0));
    console.log(`Date: ${day}, Atomic Arb Volume in $: ${formattedVol}`);
  });
  // call new function here
}
export async function generateVolumeReportForSinglePool(poolId) {
  // Fetch volume data
  // Full October
  const startUnixtime = 1696111200;
  const endUnixtime = 1698793199;
  const dailyVolumes = await calculateDailyVolumes(poolId, startUnixtime, endUnixtime);
  // console.log("dailyVolumes", dailyVolumes);
  const sandwichDailyVolumes = await calculateDailySandwichVolumes(poolId);
  // console.log("sandwichDailyVolumes", sandwichDailyVolumes);
  const dailyArbVolumes = await dailyVolumeByAtomicArb(poolId);
  // console.log("dailyArbVolumes", dailyArbVolumes);
  // Normalize date formats and consolidate data
  const volumeData = {};
  for (const [date, volume] of Object.entries(dailyVolumes)) {
    volumeData[date] = {
      totalVolume: volume,
      sandwichVolume: sandwichDailyVolumes[date] || 0,
      arbVolume: dailyArbVolumes[date] || 0,
    };
  }
  // Create a new workbook and add a sheet
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Volume Data");
  // Define the columns
  sheet.columns = [
    { header: "Date", key: "date" },
    { header: "Total Daily Volume ($)", key: "totalVolume" },
    { header: "Sandwich Attack Volume ($)", key: "sandwichVolume" },
    { header: "Atomic Arb Volume ($)", key: "arbVolume" },
  ];
  // Add rows to the sheet
  for (const [date, volumes] of Object.entries(volumeData)) {
    sheet.addRow({
      date: date,
      totalVolume: Number((volumes.totalVolume / 1e6).toFixed(3)),
      sandwichVolume: Number((volumes.sandwichVolume / 1e6).toFixed(3)),
      arbVolume: Number((volumes.arbVolume / 1e6).toFixed(3)),
    });
  }
  // Save the workbook to a file
  await workbook.xlsx.writeFile("Tricrypto2VolumeReport.xlsx");
  console.log("Volume report saved as Tricrypto2VolumeReport.xlsx");
}
//# sourceMappingURL=Fetch.js.map
