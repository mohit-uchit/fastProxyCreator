"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Copy, ArrowUpDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { toast } from "sonner"

export interface Proxy {
  _id: string
  ip: string
  port: string
  username: string
  password: string
  user_id: string
  createdAt: string
  status: string
}

const CopyButton = ({ text }: { text: string }) => {
  const [copying, setCopying] = useState(false)

  const copyToClipboard = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(text)
      toast.success("Proxy copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy proxy")
    } finally {
      setTimeout(() => {
        setCopying(false)
      }, 1000)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copyToClipboard}
      disabled={copying}
      className="relative"
    >
      {copying ? (
        <Check className="h-4 w-4 text-green-500 animate-in zoom-in duration-300" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )
}

export const columns: ColumnDef<Proxy>[] = [
  {
    accessorKey: "ip",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        IP Address
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    filterFn: "includesString"
  },
  {
    accessorKey: "port",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Port
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    filterFn: "includesString"
  },
  {
    accessorKey: "username",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Username
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    filterFn: "includesString"
  },
  {
    accessorKey: "password",
    header: "Password",
    cell: () => "••••••••", // Hide actual password
    enableSorting: false,
    enableColumnFilter: false
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Created At
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => format(new Date(row.getValue("createdAt")), "PPpp"),
    sortingFn: "datetime",
    enableColumnFilter: false
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const proxy = row.original
      const copyText = `${proxy.ip}:${proxy.port}:${proxy.username}:${proxy.password}`
      return <CopyButton text={copyText} />
    },
    enableSorting: false,
    enableColumnFilter: false
  },
]