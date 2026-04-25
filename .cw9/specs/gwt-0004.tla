---- MODULE ForkHandlerInheritsSettings ----
EXTENDS Integers, Sequences, TLC

(* --algorithm ForkHandlerInheritsSettings

variables
    phase                 = "idle",
    payloadProvider       = "UNSET",
    payloadPermissionMode = "UNSET",
    payloadProjectPath    = "UNSET",
    payloadCwd            = "UNSET",
    payloadToolsSettings  = "UNSET",
    toolsSettingsSource   = "UNSET",
    dialogsOpen           = FALSE,
    storageKeyUsed        = "NONE",
    composerStateRead     = FALSE,
    storageRead           = FALSE,
    localStorageHasValue  \in {TRUE, FALSE};

define

    NoDialog ==
        dialogsOpen = FALSE

    LocalStorageRead ==
        phase = "Finish" => storageKeyUsed = "claude-settings"

    ComposerStatePull ==
        phase = "Finish" =>
            /\ composerStateRead     = TRUE
            /\ payloadProvider       = "claude"
            /\ payloadPermissionMode # "UNSET"
            /\ payloadProjectPath    # "UNSET"
            /\ payloadCwd            # "UNSET"

    ProviderKey ==
        storageKeyUsed # "NONE" => storageKeyUsed = "claude-settings"

    ToolsSettingsSourced ==
        phase = "Finish" =>
            toolsSettingsSource \in {"localStorage", "default"}

    PayloadComplete ==
        phase = "Finish" =>
            /\ payloadProvider       # "UNSET"
            /\ payloadPermissionMode # "UNSET"
            /\ payloadProjectPath    # "UNSET"
            /\ payloadCwd            # "UNSET"
            /\ payloadToolsSettings  # "UNSET"
            /\ storageRead           = TRUE
            /\ composerStateRead     = TRUE

    AllInvariants ==
        /\ NoDialog
        /\ LocalStorageRead
        /\ ComposerStatePull
        /\ ProviderKey
        /\ ToolsSettingsSourced
        /\ PayloadComplete

end define;

fair process forkHandler = "forkHandler"
begin
    InvokeFork:
        phase := "forking";

    ReadComposerState:
        payloadProvider       := "claude";
        payloadPermissionMode := "default";
        payloadProjectPath    := "/work/proj";
        payloadCwd            := "/work/proj";
        composerStateRead     := TRUE;

    GetToolsSettings:
        storageKeyUsed := "claude-settings";
        if localStorageHasValue then
            payloadToolsSettings := "STORED_SETTINGS";
            toolsSettingsSource  := "localStorage";
        else
            payloadToolsSettings := "DEFAULT_SETTINGS";
            toolsSettingsSource  := "default";
        end if;

    AfterStorage:
        storageRead := TRUE;

    BuildPayload:
        phase := "payloadBuilt";

    Finish:
        phase := "Finish";

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "718ab6fa" /\ chksum(tla) = "8db021ef")
VARIABLES pc, phase, payloadProvider, payloadPermissionMode, 
          payloadProjectPath, payloadCwd, payloadToolsSettings, 
          toolsSettingsSource, dialogsOpen, storageKeyUsed, composerStateRead, 
          storageRead, localStorageHasValue

(* define statement *)
NoDialog ==
    dialogsOpen = FALSE

LocalStorageRead ==
    phase = "Finish" => storageKeyUsed = "claude-settings"

ComposerStatePull ==
    phase = "Finish" =>
        /\ composerStateRead     = TRUE
        /\ payloadProvider       = "claude"
        /\ payloadPermissionMode # "UNSET"
        /\ payloadProjectPath    # "UNSET"
        /\ payloadCwd            # "UNSET"

ProviderKey ==
    storageKeyUsed # "NONE" => storageKeyUsed = "claude-settings"

ToolsSettingsSourced ==
    phase = "Finish" =>
        toolsSettingsSource \in {"localStorage", "default"}

PayloadComplete ==
    phase = "Finish" =>
        /\ payloadProvider       # "UNSET"
        /\ payloadPermissionMode # "UNSET"
        /\ payloadProjectPath    # "UNSET"
        /\ payloadCwd            # "UNSET"
        /\ payloadToolsSettings  # "UNSET"
        /\ storageRead           = TRUE
        /\ composerStateRead     = TRUE

AllInvariants ==
    /\ NoDialog
    /\ LocalStorageRead
    /\ ComposerStatePull
    /\ ProviderKey
    /\ ToolsSettingsSourced
    /\ PayloadComplete


vars == << pc, phase, payloadProvider, payloadPermissionMode, 
           payloadProjectPath, payloadCwd, payloadToolsSettings, 
           toolsSettingsSource, dialogsOpen, storageKeyUsed, 
           composerStateRead, storageRead, localStorageHasValue >>

ProcSet == {"forkHandler"}

Init == (* Global variables *)
        /\ phase = "idle"
        /\ payloadProvider = "UNSET"
        /\ payloadPermissionMode = "UNSET"
        /\ payloadProjectPath = "UNSET"
        /\ payloadCwd = "UNSET"
        /\ payloadToolsSettings = "UNSET"
        /\ toolsSettingsSource = "UNSET"
        /\ dialogsOpen = FALSE
        /\ storageKeyUsed = "NONE"
        /\ composerStateRead = FALSE
        /\ storageRead = FALSE
        /\ localStorageHasValue \in {TRUE, FALSE}
        /\ pc = [self \in ProcSet |-> "InvokeFork"]

InvokeFork == /\ pc["forkHandler"] = "InvokeFork"
              /\ phase' = "forking"
              /\ pc' = [pc EXCEPT !["forkHandler"] = "ReadComposerState"]
              /\ UNCHANGED << payloadProvider, payloadPermissionMode, 
                              payloadProjectPath, payloadCwd, 
                              payloadToolsSettings, toolsSettingsSource, 
                              dialogsOpen, storageKeyUsed, composerStateRead, 
                              storageRead, localStorageHasValue >>

ReadComposerState == /\ pc["forkHandler"] = "ReadComposerState"
                     /\ payloadProvider' = "claude"
                     /\ payloadPermissionMode' = "default"
                     /\ payloadProjectPath' = "/work/proj"
                     /\ payloadCwd' = "/work/proj"
                     /\ composerStateRead' = TRUE
                     /\ pc' = [pc EXCEPT !["forkHandler"] = "GetToolsSettings"]
                     /\ UNCHANGED << phase, payloadToolsSettings, 
                                     toolsSettingsSource, dialogsOpen, 
                                     storageKeyUsed, storageRead, 
                                     localStorageHasValue >>

GetToolsSettings == /\ pc["forkHandler"] = "GetToolsSettings"
                    /\ storageKeyUsed' = "claude-settings"
                    /\ IF localStorageHasValue
                          THEN /\ payloadToolsSettings' = "STORED_SETTINGS"
                               /\ toolsSettingsSource' = "localStorage"
                          ELSE /\ payloadToolsSettings' = "DEFAULT_SETTINGS"
                               /\ toolsSettingsSource' = "default"
                    /\ pc' = [pc EXCEPT !["forkHandler"] = "AfterStorage"]
                    /\ UNCHANGED << phase, payloadProvider, 
                                    payloadPermissionMode, payloadProjectPath, 
                                    payloadCwd, dialogsOpen, composerStateRead, 
                                    storageRead, localStorageHasValue >>

AfterStorage == /\ pc["forkHandler"] = "AfterStorage"
                /\ storageRead' = TRUE
                /\ pc' = [pc EXCEPT !["forkHandler"] = "BuildPayload"]
                /\ UNCHANGED << phase, payloadProvider, payloadPermissionMode, 
                                payloadProjectPath, payloadCwd, 
                                payloadToolsSettings, toolsSettingsSource, 
                                dialogsOpen, storageKeyUsed, composerStateRead, 
                                localStorageHasValue >>

BuildPayload == /\ pc["forkHandler"] = "BuildPayload"
                /\ phase' = "payloadBuilt"
                /\ pc' = [pc EXCEPT !["forkHandler"] = "Finish"]
                /\ UNCHANGED << payloadProvider, payloadPermissionMode, 
                                payloadProjectPath, payloadCwd, 
                                payloadToolsSettings, toolsSettingsSource, 
                                dialogsOpen, storageKeyUsed, composerStateRead, 
                                storageRead, localStorageHasValue >>

Finish == /\ pc["forkHandler"] = "Finish"
          /\ phase' = "Finish"
          /\ pc' = [pc EXCEPT !["forkHandler"] = "Done"]
          /\ UNCHANGED << payloadProvider, payloadPermissionMode, 
                          payloadProjectPath, payloadCwd, payloadToolsSettings, 
                          toolsSettingsSource, dialogsOpen, storageKeyUsed, 
                          composerStateRead, storageRead, localStorageHasValue >>

forkHandler == InvokeFork \/ ReadComposerState \/ GetToolsSettings
                  \/ AfterStorage \/ BuildPayload \/ Finish

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == forkHandler
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(forkHandler)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

\* cfg for ForkHandlerInheritsSettings.cfg:
\*
\* INVARIANT NoDialog
\* INVARIANT LocalStorageRead
\* INVARIANT ComposerStatePull
\* INVARIANT ProviderKey
\* INVARIANT ToolsSettingsSourced
\* INVARIANT PayloadComplete

====
