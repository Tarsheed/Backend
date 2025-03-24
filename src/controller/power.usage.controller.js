import Device from "../models/device.model";
import PowerUsage from "../models/power.usage.model";
import { getOpenAIResponse } from "../service/open.api.service";


export const getHistoricalUsage = async (deviceIds) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const history = await PowerUsage.aggregate([
        { $match: { deviceId: { $in: deviceIds }, createdAt: { $gte: oneWeekAgo } } },
        { $group: { _id: "$deviceId", totalUsage: { $sum: "$usage" } } }
    ]);

    return history.reduce((acc, entry) => {
        acc[entry._id] = entry.totalUsage;
        return acc;
    }, {});
};

export const recoredPowerUsage = async (req, res) => {
    try {
        const { roomId } = req.parmas;
        const { totalUsage } = req.body;

        const devices = await Device.find({ roomId });
        if (!devices.length) {
            return res.status(400).json({ message: "No devices found" });
        }

        const devicesId = devices.map(device => device._id);
        const devicesHistory = await getHistoricalUsage(deviceIds);

        const prompt = `
        We have ${totalUsage} watts consumed across ${devices.length} IoT devices.
        Each device has historical usage data for the last 7 days.
        
        Devices:
        ${devices.map(device =>
            `Device ${device._id} (Past Usage: ${historicalUsage[device._id] || 0}Wh)`
        ).join("\n")}
        
        Distribute the total power consumption based only on historical usage.
        Output JSON: [{"deviceId": "id", "usage": value}].
        `;



        const aiResponseText = await getOpenAIResponse(prompt);
        const aiResult = JSON.parse(aiResponseText);


        const savedUsage = await PowerUsage.insertMany(
            aiResult.map(d => ({ deviceId: d.deviceId, usage: d.usage }))
        );

        res.status(201).json({ message: "Usage Distributed", data: savedUsage });


    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}