import { CHANNELS, channelLabel, isChannel } from "@/lib/channels";

export function ChannelName({ channel }: { channel: string }) {
  const color = isChannel(channel) ? CHANNELS[channel].color : CHANNELS.other.color;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
      {channelLabel(channel)}
    </span>
  );
}
