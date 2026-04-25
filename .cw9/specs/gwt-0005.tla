---- MODULE GWT0005ForwardsResume ----

EXTENDS TLC

CONSTANTS
    RESUME_VALUE,
    CWD_VALUE,
    MODEL_VALUE

(* --algorithm GWT0005ForwardsResume

variables
    resumePresent \in {TRUE, FALSE},
    inputCwd      = CWD_VALUE,
    inputModel    = MODEL_VALUE,
    sdkResume     = "UNSET",
    sdkCwd        = "UNSET",
    sdkModel      = "UNSET",
    phase         = "Init";

define

    ResumeForwarded ==
        (resumePresent /\ phase = "Complete") =>
            sdkResume = RESUME_VALUE

    ResumeAbsent ==
        ((~resumePresent) /\ phase = "Complete") =>
            sdkResume = "UNSET"

    NoClobberCwd ==
        phase = "Complete" =>
            sdkCwd = inputCwd

    NoClobberModel ==
        phase = "Complete" =>
            sdkModel = inputModel

    AllInvariants ==
        ResumeForwarded /\ ResumeAbsent /\ NoClobberCwd /\ NoClobberModel

end define;

fair process mapper = "mapper"
begin
    BuildBase:
        sdkCwd   := inputCwd;
        sdkModel := inputModel;
        phase    := "BaseBuilt";
    CopyResume:
        if resumePresent then
            sdkResume := RESUME_VALUE;
        end if;
    Complete:
        phase := "Complete";
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "409fabda" /\ chksum(tla) = "b0f015d8")
VARIABLES pc, resumePresent, inputCwd, inputModel, sdkResume, sdkCwd, 
          sdkModel, phase

(* define statement *)
ResumeForwarded ==
    (resumePresent /\ phase = "Complete") =>
        sdkResume = RESUME_VALUE

ResumeAbsent ==
    ((~resumePresent) /\ phase = "Complete") =>
        sdkResume = "UNSET"

NoClobberCwd ==
    phase = "Complete" =>
        sdkCwd = inputCwd

NoClobberModel ==
    phase = "Complete" =>
        sdkModel = inputModel

AllInvariants ==
    ResumeForwarded /\ ResumeAbsent /\ NoClobberCwd /\ NoClobberModel


vars == << pc, resumePresent, inputCwd, inputModel, sdkResume, sdkCwd, 
           sdkModel, phase >>

ProcSet == {"mapper"}

Init == (* Global variables *)
        /\ resumePresent \in {TRUE, FALSE}
        /\ inputCwd = CWD_VALUE
        /\ inputModel = MODEL_VALUE
        /\ sdkResume = "UNSET"
        /\ sdkCwd = "UNSET"
        /\ sdkModel = "UNSET"
        /\ phase = "Init"
        /\ pc = [self \in ProcSet |-> "BuildBase"]

BuildBase == /\ pc["mapper"] = "BuildBase"
             /\ sdkCwd' = inputCwd
             /\ sdkModel' = inputModel
             /\ phase' = "BaseBuilt"
             /\ pc' = [pc EXCEPT !["mapper"] = "CopyResume"]
             /\ UNCHANGED << resumePresent, inputCwd, inputModel, sdkResume >>

CopyResume == /\ pc["mapper"] = "CopyResume"
              /\ IF resumePresent
                    THEN /\ sdkResume' = RESUME_VALUE
                    ELSE /\ TRUE
                         /\ UNCHANGED sdkResume
              /\ pc' = [pc EXCEPT !["mapper"] = "Complete"]
              /\ UNCHANGED << resumePresent, inputCwd, inputModel, sdkCwd, 
                              sdkModel, phase >>

Complete == /\ pc["mapper"] = "Complete"
            /\ phase' = "Complete"
            /\ pc' = [pc EXCEPT !["mapper"] = "Done"]
            /\ UNCHANGED << resumePresent, inputCwd, inputModel, sdkResume, 
                            sdkCwd, sdkModel >>

mapper == BuildBase \/ CopyResume \/ Complete

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == mapper
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(mapper)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
